from django.urls import path
from .views import start_session, check_in, check_out, end_session
from .views import student_report
from .views import lecturer_session_report

urlpatterns = [
    path('attendance/start/', start_session,name='start_session'),
    path('attendance/check-in/', check_in,name='check_in'),
    path('attendance/check-out/', check_out,name='check_out'),
    path('attendance/end/', end_session,name='end_session'),
    path('attendance/report/', student_report,name='student_report'),
    path('attendance/session-report/<int:session_id>/', lecturer_session_report,name='lecturer_session_report'),
]