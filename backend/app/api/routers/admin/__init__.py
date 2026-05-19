from fastapi import APIRouter

from .broadcasts import router as broadcasts_router
from .campaigns import router as campaigns_router
from .materials import router as materials_router
from .sequence_steps import router as sequence_steps_router
from .sequences import router as sequences_router
from .stats import router as stats_router
from .users import router as users_router

router = APIRouter(prefix="/api/admin", tags=["admin"])
router.include_router(stats_router)
router.include_router(campaigns_router, prefix="/campaigns")
router.include_router(materials_router, prefix="/materials")
router.include_router(sequences_router, prefix="/sequences")
router.include_router(sequence_steps_router, prefix="/sequence-steps")
router.include_router(users_router, prefix="/users")
router.include_router(broadcasts_router, prefix="/broadcasts")
