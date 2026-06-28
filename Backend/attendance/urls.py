from django.urls import path
from .views import start_session
from .views import (
    start_session,
    check_in,
    check_out,
    end_session,
    lecturer_dashboard
)

urlpatterns = [
    # Lecturer session control
    path('start-session/', start_session, name='start_session'),
    path('end-session/', end_session, name='end_session'),


    # Student attendance
    path('check-in/', check_in, name='check_in'),
    path('check-out/', check_out, name='check_out'),

    # Lecturer dashboard
    path('lecturer/dashboard/', lecturer_dashboard, name='lecturer_dashboard'),
]