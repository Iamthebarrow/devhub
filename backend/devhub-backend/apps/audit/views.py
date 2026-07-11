from datetime import datetime, time

from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.accounts.permissions import IsViewerOrHigher
from apps.audit.models import AuditEvent
from apps.audit.serializers import AuditEventSerializer


class AuditPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


@extend_schema_view(
    get=extend_schema(
        tags=["audit"],
        summary="List audit events",
        description="Returns paginated audit events with optional filtering.",
        parameters=[
            OpenApiParameter(name="action", type=str, description="Filter by action (exact match)"),
            OpenApiParameter(name="status", type=str, description="Filter by status (success/error)"),
            OpenApiParameter(name="actor", type=str, description="Filter by actor username"),
            OpenApiParameter(name="from", type=str, description="Filter events from date (YYYY-MM-DD)"),
            OpenApiParameter(name="to", type=str, description="Filter events to date (YYYY-MM-DD)"),
            OpenApiParameter(name="search", type=str, description="Search across action, resource, and actor"),
        ],
    ),
)
class AuditEventListView(ListAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsViewerOrHigher]
    serializer_class = AuditEventSerializer
    pagination_class = AuditPagination

    def get_queryset(self):
        qs = AuditEvent.objects.select_related("actor").all()
        params = self.request.query_params

        action = params.get("action")
        if action:
            qs = qs.filter(action=action)

        status = params.get("status")
        if status:
            qs = qs.filter(status=status)

        actor = params.get("actor")
        if actor:
            qs = qs.filter(actor__username=actor)

        date_from = params.get("from")
        if date_from:
            try:
                dt = datetime.strptime(date_from, "%Y-%m-%d")
                qs = qs.filter(created_at__gte=dt)
            except ValueError:
                pass

        date_to = params.get("to")
        if date_to:
            try:
                dt = datetime.strptime(date_to, "%Y-%m-%d")
                qs = qs.filter(created_at__lte=datetime.combine(dt, time.max))
            except ValueError:
                pass

        search = params.get("search")
        if search:
            qs = qs.filter(
                Q(action__icontains=search)
                | Q(resource_name__icontains=search)
                | Q(resource_id__icontains=search)
                | Q(resource_type__icontains=search)
                | Q(actor__username__icontains=search)
            )

        return qs
