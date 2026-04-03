from datetime import date

from pydantic import BaseModel


class TeacherSessionItem(BaseModel):
    id: int
    formation_title: str
    label: str
    start_date: date
    campus_label: str
    seat_capacity: int
    enrolled_count: int
    teacher_name: str
    status: str


class TeacherOverview(BaseModel):
    assigned_sessions_count: int
    planned_sessions_count: int
    open_sessions_count: int
    total_students_count: int
    next_session_label: str | None
    sessions: list[TeacherSessionItem]
