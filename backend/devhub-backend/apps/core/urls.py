"""
URL configuration for core app.
"""

from django.urls import path

from . import views

app_name = "core"

urlpatterns = [
    path("health/", views.health, name="health"),
    path("version/", views.version, name="version"),
]
