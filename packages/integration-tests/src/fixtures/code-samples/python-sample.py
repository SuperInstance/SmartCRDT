"""
Sample Python file for cross-language import parsing tests
Demonstrates Python import patterns
"""

# Standard library imports
import os
import sys
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from pathlib import Path

# Third-party imports
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, validator

# Relative imports
from .models import User, Post
from .database import get_db
from .utils import hash_password, verify_password
from .config import settings

# Package imports
from mypackage.core import Processor
from mypackage.utils import Logger, format_date


class UserCreate(BaseModel):
    """Schema for creating a user"""
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., regex=r'^[^@]+@[^@]+\.[^@]+$')
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None

    @validator('email')
    def email_must_be_valid(cls, v):
        if '@example.com' not in v:
            raise ValueError('Email must be from example.com domain')
        return v


class UserResponse(BaseModel):
    """Schema for user response"""
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    created_at: datetime


class UserService:
    """Service for user operations"""

    def __init__(self, db: Session):
        self.db = db
        self.logger = Logger(__name__)

    async def create_user(self, user_data: UserCreate) -> User:
        """Create a new user"""
        try:
            # Check if user exists
            existing_user = self.db.query(User).filter(
                User.email == user_data.email
            ).first()

            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="Email already registered"
                )

            # Hash password
            hashed_pw = hash_password(user_data.password)

            # Create user
            user = User(
                username=user_data.username,
                email=user_data.email,
                hashed_password=hashed_pw,
                full_name=user_data.full_name
            )

            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)

            self.logger.info(f"User created: {user.id}")
            return user

        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error creating user: {e}")
            raise

    async def get_user(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        return self.db.query(User).filter(User.id == user_id).first()

    async def list_users(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> List[User]:
        """List all users with pagination"""
        return self.db.query(User).offset(skip).limit(limit).all()


# FastAPI app
app = FastAPI(title="User Management API", version="1.0.0")


@app.post("/users/", response_model=UserResponse)
async def create_user_endpoint(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """Create a new user"""
    service = UserService(db)
    user = await service.create_user(user_data)
    return user


@app.get("/users/{user_id}", response_model=UserResponse)
async def get_user_endpoint(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get user by ID"""
    service = UserService(db)
    user = await service.get_user(user_id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


@app.get("/users/", response_model=List[UserResponse])
async def list_users_endpoint(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all users"""
    service = UserService(db)
    users = await service.list_users(skip=skip, limit=limit)
    return users


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
