"""
Simple RabbitMQ Consumer

A basic RabbitMQ consumer that continuously receives messages and processes them.
"""

import pika
import json
import sys
import requests
from minio import Minio
from minio.error import S3Error
from io import BytesIO
import hashlib
from datetime import datetime
from docling.document_converter import DocumentConverter

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

def generate_object_name(id, content_type):
    """
    Generate a unique object name for MinIO storage.
    
    Args:
        id: Source ID
        content_type: Content type from response
        
    Returns:
        str: Object name with appropriate extension
    """
    # Determine file extension from content type
    extension_map = {
        'text/plain': 'txt',
        'text/html': 'html',
        'application/pdf': 'pdf',
        'application/json': 'json',
        'application/xml': 'xml',
        'text/xml': 'xml',
        'text/csv': 'csv',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    }
    
    # Get extension from content type or default to 'bin'
    ext = extension_map.get(content_type.split(';')[0].strip(), 'bin')
    
    return f"{id}.{ext}"

def stream_content_from_url(url):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; StudyHelper/0.0.1; Educational Research Tool; +https://github.com/beardedtim/study-helper)'
        }
        
        response = requests.get(url, headers=headers, timeout=30, stream=True)
        response.raise_for_status()
        
        content_length = response.headers.get('content-length')
        # get content length or default to -1
        content_length = int(content_length) if content_length else -1
        
        # get content length or default to octet
        content_type = response.headers.get('content-type', 'application/octet-stream').lower()
        
        return response, content_length, content_type
            
    except Exception as e:
        print(f"Error streaming content from {url}: {e}")
        return None, None, None


def process_message(body, minio_client):
    """
    Process a single message (unit of work).
    
    Args:
        body: Message body as bytes
    """
    try:
        # Parse JSON message
        message = json.loads(body.decode('utf-8'))
        id = message.get('id')
        data = message.get('data')
        url = data.get('url')
        source_id = data.get('source_id')

        if not url or not source_id:
            print('Error: No url or source_id given')
            return
        
        print(f"Processing: {id} from source {source_id}")
        print(f"URL: {url}")
        response_stream, content_length, content_type = stream_content_from_url(url)

        if response_stream:
            print(f"Successfully opened stream from {url}")
            print(f"Content type: {content_type}")
            print(f"Content length: {content_length if content_length > 0 else 'unknown'}")
            
            # Generate object name for MinIO (now includes proper extension)
            object_name = generate_object_name(source_id, content_type)
            bucket_name = "ingest"  # Adjust bucket name as needed
            
            # Stream directly to MinIO
            success = stream_to_minio(minio_client, bucket_name, object_name, response_stream, content_length, content_type)
            
            if success:
                print(f"Document {source_id} successfully streamed and uploaded to MinIO")
            else:
                print(f"Failed to stream document {source_id} to MinIO")
        else:
            print(f"Failed to open stream from {url}")
        
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
        
        queue_name = 'ingest'
        channel.queue_declare(queue=queue_name, durable=True)
        
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