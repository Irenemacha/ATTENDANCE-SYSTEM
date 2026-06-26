from django.urls import path
from . import views

urlpatterns = [
    path('', views.course_list_create,name='course_list_create'),
]