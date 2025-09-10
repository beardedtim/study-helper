"""
Simple RabbitMQ Consumer

A basic RabbitMQ consumer that continuously receives messages and processes them.
"""

import pika
import json
import sys
import requests
from io import BytesIO
import os
import hashlib
from datetime import datetime
from minio import Minio
from minio.error import S3Error
from chonkie import RecursiveChunker
from ollama import embed
import psycopg2
from psycopg2.extras import RealDictCursor
import psycopg2.pool


def setup_postgres_connection():
    """
    Set up PostgreSQL connection pool.
    Adjust these parameters according to your PostgreSQL setup.
    """
    return psycopg2.pool.SimpleConnectionPool(
        minconn=1,
        maxconn=10,
        host="0.0.0.0",
        port=9999,
        database="study_helper",
        user="overlord",
        password="ou812"
    )

postgres_conn = setup_postgres_connection()


def save_chunk(source_id, start, end, embedding, text, model="default-embedding-model"):
    """
    Save a text chunk with its embedding to the chunks_1024 table.
    
    Args:
        source_id (UUID): Reference to the source document
        start (int): Starting position of the chunk in the source
        end (int): Ending position of the chunk in the source
        embedding (list): The 1024-dimensional embedding vector
        text (str): The actual text content of the chunk
        model (str): The embedding model used (optional, defaults to "default-embedding-model")
    
    Returns:
        UUID: The ID of the inserted chunk, or None if insertion failed
    """
    try:
        conn = postgres_conn.getconn()
        try:
            with conn.cursor() as cursor:
                # Prepare the metadata with start and end positions
                metadata = {
                    "start": start,
                    "end": end
                }
                
                # Insert the chunk into the database
                insert_query = """
                    INSERT INTO chunks_1024 (embeddings, chunk, metadata, model, source_id)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id;
                """
                
                cursor.execute(insert_query, (
                    embedding,  # PostgreSQL will handle the vector conversion
                    text,
                    json.dumps(metadata),   # JSONB conversion
                    model,
                    source_id
                ))
                
                # Get the generated ID
                result = cursor.fetchone()
                chunk_id = result[0] if result else None
                cursor.connection.commit()
                return chunk_id
        finally:
            # Always return connection to pool
            postgres_conn.putconn(conn)
    except Exception as e:
        print(f"Error saving chunk: {e}")
        return None

def setup_minio_client():
    """
    Set up MinIO client with connection parameters.
    Adjust these parameters according to your MinIO setup.
    """
    return Minio(
        "localhost:9996",  # MinIO server endpoint
        access_key="minioadmin",  # Access key
        secret_key="minioadmin",  # Secret key
        secure=False  # Set to True if using HTTPS
    )

def stream_to_minio(minio_client, bucket_name, object_name, response_stream, content_length, content_type):
    """
    Stream content directly to MinIO.
    
    Args:
        minio_client: MinIO client instance
        bucket_name: Target bucket name
        object_name: Object name in MinIO
        response_stream: HTTP response stream
        content_length: Content length (-1 if unknown)
        content_type: Content type from response headers
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Ensure bucket exists
        if not minio_client.bucket_exists(bucket_name):
            minio_client.make_bucket(bucket_name)
            print(f"Created bucket: {bucket_name}")
        
        # Stream directly to MinIO
        if content_length > 0:
            minio_client.put_object(
                bucket_name,
                object_name,
                response_stream.raw,
                length=content_length,
                content_type=content_type
            )
        else:
            # If content length is unknown, use -1 for unknown size
            minio_client.put_object(
                bucket_name,
                object_name,
                response_stream.raw,
                length=-1,
                content_type=content_type
            )
        
        print(f"Successfully streamed {object_name} to bucket {bucket_name}")
        return True
        
    except S3Error as e:
        print(f"MinIO error streaming {object_name}: {e}")
        return False
    except Exception as e:
        print(f"Error streaming {object_name} to MinIO: {e}")
        return False
    finally:
        # Always close the response stream
        response_stream.close()

def stream_from_minoio(minio_client, bucket_name, object_name):
    """
    Stream content directly from MinIO.
    
    Args:
        minio_client: MinIO client instance
        bucket_name: Target bucket name
        object_name: Object name in MinIO
        
    Returns:
        response_stream: HTTP response stream or None if error
    """
    try:
        response = minio_client.get_object(bucket_name, object_name)
        print(f"Successfully retrieved {object_name} from bucket {bucket_name}")
        return response
        
    except S3Error as e:
        print(f"MinIO error retrieving {object_name}: {e}")
        return None
    except Exception as e:
        print(f"Error retrieving {object_name} from MinIO: {e}")
        return None

def chunk_data(data):
    """
    Chunk data into smaller pieces.
    Args:
        data: Input text data
        chunk_size: Desired chunk size in tokens
    Returns:
        Chunkie object with chunks
    """
    chunker = RecursiveChunker()

    return chunker.chunk(data)

def getEmbeddings(text):
    """
    Get embeddings for the given text using an external API.
    
    Args:
        text: Input text string
        
    Returns:
        list: Embedding vector or None if error
    """
    try:
        # Use ollama sdk to get embeddings
        return embed(model="ryanshillington/Qwen3-Embedding-0.6B", input=text)["embeddings"][0]

    except requests.RequestException as e:
        print(f"Error fetching embeddings: {e}")
        return None

def process_message(body, minio_client):
    """
    Process a single message (unit of work).
    
    Args:
        body: Message body as bytes
    """
    try:
        # Parse JSON message
        message = json.loads(body.decode('utf-8'))
        
        # Extract relevant fields
        records = message.get('Records', [])
        for record in records:
            s3_info = record.get('s3', {})
            bucket_name = s3_info.get('bucket', {}).get('name')
            object_key = s3_info.get('object', {}).get('key')
            
            source_id = os.path.splitext(object_key)[0] 
            print(f"Processing object: {object_key} from bucket: {bucket_name}")
            
            if not bucket_name or not object_key or not source_id:
                print("Invalid message format: missing bucket or object key")
                continue

            # Download the object from MinIO
            response_stream = stream_from_minoio(minio_client, bucket_name, object_key)
            if response_stream is None:
                print(f"Failed to retrieve object {object_key} from bucket {bucket_name}")
                continue
            
            # Chunk data
            data = response_stream.read()
            txt = data.decode('utf-8')
            chunks = chunk_data(txt)
            source_id = os.path.splitext(object_key)[0] 
            print(f"Chunked data into {len(chunks)} chunks")
            for i, chunk in enumerate(chunks):
                chunk_text = chunk.text
                start_index = chunk.start_index
                end_index = chunk.end_index
                embedding = getEmbeddings(chunk_text)
                 # Save to PostgreSQL using our new function
                if embedding:
                    chunk_id = save_chunk(
                        source_id=source_id,
                        start=start_index,
                        end=end_index,
                        embedding=embedding,
                        text=chunk_text,
                        model="ryanshillington/Qwen3-Embedding-0.6B"
                    )
                    
                    if chunk_id:
                        print(f"Saved chunk {i+1}/{len(chunks)} with ID: {chunk_id}")
                    else:
                        print(f"Failed to save chunk {i+1}/{len(chunks)}")
                else:
                    print(f"No embedding generated for chunk {i+1}/{len(chunks)}")
                    

            response_stream.close()
        
    except json.JSONDecodeError:
        print(f"Invalid JSON message: {body}")
    except Exception as e:
        print(f"Error processing message: {e}")


def callback(ch, method, properties, body):
    """
    RabbitMQ callback function for received messages.
    """
    minio_client = setup_minio_client()
    process_message(body, minio_client)
    
    # Acknowledge the message (tells RabbitMQ it was processed)
    ch.basic_ack(delivery_tag=method.delivery_tag)


def main():
    """Main consumer loop."""
    # Connection parameters
    connection_params = pika.ConnectionParameters('localhost', 9997)
    
    try:
        # Test MinIO connection
        print("Testing MinIO connection...")
        minio_client = setup_minio_client()
        # Simple test to verify connection
        list(minio_client.list_buckets())
        print("MinIO connection successful!")
        
        # Connect to RabbitMQ
        connection = pika.BlockingConnection(connection_params)
        channel = connection.channel()
        # This must match the exchange MinIO is configured to use
        exchange_name = "minio-events"
        queue_name = "ingest-events"
        # Declare the queue and bind it to the exchange
        channel.queue_declare(queue=queue_name, durable=True)
        channel.queue_bind(queue=queue_name, exchange=exchange_name)
        
        # Set up fair dispatch (one message per worker at a time)
        channel.basic_qos(prefetch_count=1)
        
        # Set up consumer
        channel.basic_consume(queue=queue_name, on_message_callback=callback)
        
        print(f"Waiting for messages from '{queue_name}'. To exit press CTRL+C")
        
        # Start consuming messages
        channel.start_consuming()
        
    except KeyboardInterrupt:
        print("\nStopping consumer...")
        channel.stop_consuming()
        connection.close()
        sys.exit(0)
        
    except Exception as e:
        print(f"Connection failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()