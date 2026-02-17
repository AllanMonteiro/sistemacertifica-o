from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    APP_NAME: str = 'Sistema de Certificações - Conformidade e Auditoria'
    DATABASE_URL: str = 'postgresql+psycopg://fsc:fsc@db:5432/fsc_db'
    JWT_SECRET: str = 'trocar_isto'
    JWT_ALGORITHM: str = 'HS256'
    JWT_EXPIRE_MINUTES: int = 480

    S3_ENDPOINT: str = 'http://minio:9000'
    S3_ACCESS_KEY: str = 'minio'
    S3_SECRET_KEY: str = 'minio12345'
    S3_BUCKET: str = 'evidencias'
    S3_REGION: str = 'us-east-1'
    S3_STRICT_STARTUP: bool = False

    CORS_ORIGINS: str = 'http://localhost:5173'

    def cors_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(',') if origin.strip()]
        return origins or ['http://localhost:5173']


@lru_cache
def get_settings() -> Settings:
    return Settings()
