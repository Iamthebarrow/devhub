"""
URL configuration for Docker manager API.

All endpoints under /api/v1/docker/
"""

from django.urls import path

from . import views

app_name = "docker_manager"

urlpatterns = [
    # System endpoints (Phase 3)
    path("system/info/", views.SystemInfoView.as_view(), name="system-info"),
    path("system/version/", views.SystemVersionView.as_view(), name="system-version"),
    # Container endpoints (Phase 4)
    path("containers/", views.ContainerListView.as_view(), name="container-list"),
    path(
        "containers/<str:container_id>/",
        views.ContainerDetailView.as_view(),
        name="container-detail",
    ),
    path(
        "containers/<str:container_id>/logs/",
        views.ContainerLogsView.as_view(),
        name="container-logs",
    ),
    path(
        "containers/<str:container_id>/start/",
        views.ContainerStartView.as_view(),
        name="container-start",
    ),
    path(
        "containers/<str:container_id>/stop/",
        views.ContainerStopView.as_view(),
        name="container-stop",
    ),
    path(
        "containers/<str:container_id>/restart/",
        views.ContainerRestartView.as_view(),
        name="container-restart",
    ),
    # Image endpoints (Phase 5)
    path("images/", views.ImageListView.as_view(), name="image-list"),
    path("images/pull/", views.ImagePullView.as_view(), name="image-pull"),
    path(
        "images/<str:image_id>/remove/",
        views.ImageRemoveView.as_view(),
        name="image-remove",
    ),
    # Volume endpoints (Phase 5)
    path("volumes/", views.VolumeListView.as_view(), name="volume-list"),
    # Network endpoints (Phase 5)
    path("networks/", views.NetworkListView.as_view(), name="network-list"),
]
