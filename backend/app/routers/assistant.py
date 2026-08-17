from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.services.assistant import answer_question

router = APIRouter(tags=["assistant"])


@router.post("/assistant/ask", response_model=schemas.AssistantAskResponse)
def ask_assistant(payload: schemas.AssistantAskRequest, db: Session = Depends(get_db)):
    answer, source = answer_question(db, payload.question)
    return schemas.AssistantAskResponse(answer=answer, source=source)
