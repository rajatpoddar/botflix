from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Jellyfin
    JELLYFIN_SERVER_URL: str
    JELLYFIN_API_KEY: str
    JELLYFIN_LIBRARY_IDS: str = ""

    # CORS
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def jellyfin_library_list(self) -> list[str]:
        return [lid.strip() for lid in self.JELLYFIN_LIBRARY_IDS.split(",") if lid.strip()]


settings = Settings()
