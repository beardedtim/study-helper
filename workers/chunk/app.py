"""
Simple RabbitMQ Consumer

A basic RabbitMQ consumer that continuously receives messages and processes them.
"""

import pika
import json
import sys
import requests
from io import BytesIO
import hashlib
from datetime import datetime
from minio import Minio
from minio.error import S3Error
from chonkie import RecursiveChunker
from ollama import embed

import chromadb
client = chromadb.HttpClient(host="localhost", port=9998)


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
        return embed(model="all-minilm", input=text)["embeddings"][0]

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

            print(f"Processing object: {object_key} from bucket: {bucket_name}")
            
            if not bucket_name or not object_key:
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
            print(f"Chunked data into {len(chunks)} chunks")
            for i, chunk in enumerate(chunks):
                chunk_text = chunk.text
                start_index = chunk.start_index
                end_index = chunk.end_index
                embedding = getEmbeddings(chunk_text)
                # Save to chromadb
                if embedding:
                    print("I should save to chromadb here")
                    print(embedding)
                    collection = client.get_or_create_collection(name="all-minilm")
                    collection.add(
                        documents=[chunk_text],
                        embeddings=[embedding],
                        ids=[f"{object_key}-{i}-{datetime.utcnow().isoformat()}"],
                        metadatas=[{"start": start_index, "end": end_index, "url": f"{bucket_name}/{object_key}"}],
                    )

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