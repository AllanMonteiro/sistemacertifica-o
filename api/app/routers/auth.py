from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.rbac import require_roles
from app.core.security import authenticate_user, create_access_token, get_current_user, hash_password
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserCreate, UserOut

router = APIRouter(prefix='/api/auth', tags=['Autenticação'])


@router.post('/login', response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, payload.email, payload.senha)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Email ou senha inválidos.')

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, usuario=user)


@router.post('/register', response_model=UserOut)
def register(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
) -> UserOut:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Já existe usuário com este email.')

    new_user = User(
        nome=payload.nome,
        email=payload.email,
        role=payload.role,
        password_hash=hash_password(payload.senha),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get('/me', response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return current_user
