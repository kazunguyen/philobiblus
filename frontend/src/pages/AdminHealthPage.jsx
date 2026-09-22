import React from 'react';
import { ExternalLink, LineChart, Server } from 'lucide-react';
import { GRAFANA_URL } from '../config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MonitoringLink = ({ title, detail, url, icon: Icon }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Icon className="size-5 text-primary" /> {title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">{detail}</p>
      {url ? (
        <Button size="lg" className="w-full sm:w-auto" asChild>
          <a href={url} target="_blank" rel="noreferrer" className="text-lg">Open {title}<ExternalLink className="ml-2 size-5" /></a>
        </Button>
      ) : (
        <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          No URL configured. Set the matching VITE environment variable when building the frontend.
        </p>
      )}
    </CardContent>
  </Card>
);

const AdminHealthPage = () => (
  <div className="min-h-screen bg-muted/30">
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">System health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open the existing monitoring stack from the Administration view.
        </p>
      </div>

      <div className="max-w-2xl">
        <MonitoringLink title="Grafana" detail="Dashboards for backend availability, request rate, errors, latency, pod resources, and PVC usage." url={GRAFANA_URL} icon={LineChart} />
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><Server className="size-5 text-primary" /> Local access</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>The Helm chart already exposes backend metrics internally through its ServiceMonitor.</p>
          <p>For a local cluster, run <code>scripts/local-kubernetes/expose-monitoring.sh</code> and configure VITE_GRAFANA_URL with the Grafana address it prints before building the frontend.</p>
        </CardContent>
      </Card>
    </main>
  </div>
);

export default AdminHealthPage;
