from typing import Optional

from pydantic import BaseModel, Field


class TxIn(BaseModel):
    amount_cents: int = Field(gt=0, description="Montant en centimes, strictement positif")


class IncidentIn(BaseModel):
    kind: str
    detail: Optional[str] = None
