# CRUDBase גנרי — כל מודול יורש ממנו ומרחיב לפי הצורך
from typing import TypeVar, Generic, Type, Optional
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.session import Base

ModelType  = TypeVar("ModelType", bound=Base)
CreateType = TypeVar("CreateType", bound=BaseModel)
UpdateType = TypeVar("UpdateType", bound=BaseModel)

class CRUDBase(Generic[ModelType, CreateType, UpdateType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get(self, db: Session, id: int) -> Optional[ModelType]:
        return db.query(self.model).filter(self.model.id == id).first()

    def get_multi(self, db: Session, skip: int = 0, limit: int = 100) -> list[ModelType]:
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, obj_in: CreateType) -> ModelType:
        obj = self.model(**obj_in.model_dump())
        db.add(obj); db.commit(); db.refresh(obj)
        return obj

    def update(self, db: Session, db_obj: ModelType, obj_in: UpdateType) -> ModelType:
        for k, v in obj_in.model_dump(exclude_none=True).items():
            setattr(db_obj, k, v)
        db.commit(); db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, id: int) -> Optional[ModelType]:
        obj = self.get(db, id)
        if obj:
            db.delete(obj); db.commit()
        return obj
