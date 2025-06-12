from django.urls import path
from . import views

urlpatterns = [
    path('', views.main_page, name='main'),
    path('api/transcribe/', views.transcribe_api, name='transcribe_api'),
]
