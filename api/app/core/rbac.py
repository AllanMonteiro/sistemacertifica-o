from fastapi import Depends, HTTPException, status

from app.core.security import get_current_user
from app.models.user import RoleEnum, User


def require_roles(*roles: RoleEnum):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail='Você não possui permissão para esta ação.',
            )
        return current_user

    return dependency
