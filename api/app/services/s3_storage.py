from botocore.client import Config
import boto3
from botocore.exceptions import ClientError

from app.core.config import get_settings

settings = get_settings()


def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
        config=Config(s3={'addressing_style': 'path'}),
    )


def ensure_bucket_exists() -> None:
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=settings.S3_BUCKET)
    except ClientError as exc:
        codigo = str(exc.response.get('Error', {}).get('Code', ''))
        if codigo in {'404', 'NoSuchBucket', 'NotFound'}:
            client.create_bucket(Bucket=settings.S3_BUCKET)
            return
        if codigo in {'403', 'AccessDenied'}:
            return
        raise


def upload_fileobj(file_obj, key: str, content_type: str | None = None) -> str:
    client = get_s3_client()
    extra_args = {}
    if content_type:
        extra_args['ContentType'] = content_type
    client.upload_fileobj(file_obj, settings.S3_BUCKET, key, ExtraArgs=extra_args)
    return f's3://{settings.S3_BUCKET}/{key}'


def _parse_s3_uri(s3_uri: str) -> tuple[str, str] | None:
    if not s3_uri.startswith('s3://'):
        return None
    sem_prefixo = s3_uri[5:]
    if '/' not in sem_prefixo:
        return None
    bucket, key = sem_prefixo.split('/', 1)
    if not bucket or not key:
        return None
    return bucket, key


def gerar_url_pre_assinada(s3_uri: str | None, expires_in: int = 3600) -> str | None:
    if not s3_uri:
        return None
    parseado = _parse_s3_uri(s3_uri)
    if not parseado:
        return s3_uri

    bucket, key = parseado
    client = get_s3_client()
    try:
        return client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': key},
            ExpiresIn=expires_in,
        )
    except Exception:
        return s3_uri


def baixar_arquivo_s3(s3_uri: str) -> tuple[bytes, str | None]:
    parseado = _parse_s3_uri(s3_uri)
    if not parseado:
        raise ValueError('URI S3 inválida.')

    bucket, key = parseado
    client = get_s3_client()
    resposta = client.get_object(Bucket=bucket, Key=key)
    conteudo = resposta['Body'].read()
    content_type = resposta.get('ContentType')
    return conteudo, content_type
