from django.urls import path

from . import views

urlpatterns = [
    path("semesters/", views.semester_list_create, name="semester_list_create"),
    path("semesters/<int:pk>/", views.semester_detail, name="semester_detail"),
]
