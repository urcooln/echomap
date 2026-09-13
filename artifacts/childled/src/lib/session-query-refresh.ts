import type { QueryClient } from "@tanstack/react-query";
import {
  getGetChildQueryKey,
  getGetClinicianOverviewQueryKey,
  getGetDashboardQueryKey,
  getGetManualSessionSetupQueryKey,
  getGetSessionRecordingDetailQueryKey,
  getGetSessionsDashboardQueryKey,
  getListSessionsQueryKey,
} from "@workspace/api-client-react";

export const refreshSessionTrackingQueries = (
  queryClient: QueryClient,
  childId: number,
) =>
  Promise.all([
    queryClient.invalidateQueries({
      queryKey: getListSessionsQueryKey({ childId }),
    }),
    queryClient.invalidateQueries({
      queryKey: getGetSessionsDashboardQueryKey(),
    }),
    queryClient.invalidateQueries({
      queryKey: getGetSessionRecordingDetailQueryKey(),
    }),
    queryClient.invalidateQueries({
      queryKey: getGetManualSessionSetupQueryKey({ childId }),
    }),
    queryClient.invalidateQueries({
      queryKey: getGetClinicianOverviewQueryKey(),
    }),
    queryClient.invalidateQueries({
      queryKey: getGetDashboardQueryKey({ childId }),
    }),
    queryClient.invalidateQueries({
      queryKey: getGetChildQueryKey({ childId }),
    }),
  ]);
