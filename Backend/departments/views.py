from django.shortcuts import render
from rest_framework import generics

# The academic department that courses (and staff) reference lives in the
# courses app. Serving that model here keeps /api/departments/ and course
# assignment in sync.
from courses.models import Department
from .serializers import DepartmentSerializer


class DepartmentListCreateView(generics.ListCreateAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
