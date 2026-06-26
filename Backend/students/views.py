from rest_framework.response import Response
from rest_framework.decorators import api_view

@api_view(['GET'])
def student_list(request):
    return Response({"message": "Students working"})

@api_view(['GET'])
def test(request):
    return Response({"message": "Test endpoint working"})