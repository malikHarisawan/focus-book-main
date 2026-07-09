import React from 'react'
import { Card, CardContent, CardHeader } from '../ui/card'

export default function SummarySkeleton() {
  return (
    <div className="space-y-6 px-6 pb-6">
      {/* Overview Card Skeleton */}
      <Card className="bg-muted/20">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded w-full" />
            <div className="h-4 bg-muted animate-pulse rounded w-5/6" />
            <div className="h-4 bg-muted animate-pulse rounded w-4/6" />
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border/50">
            <CardHeader className="pb-3">
              <div className="h-4 bg-muted animate-pulse rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-8 bg-muted animate-pulse rounded w-20" />
                <div className="h-3 bg-muted animate-pulse rounded w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity Breakdown Skeleton */}
      <div className="space-y-4">
        <div className="h-6 bg-muted animate-pulse rounded w-48" />

        {/* Category Cards Skeleton */}
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-5 bg-muted animate-pulse rounded w-40" />
                <div className="h-6 bg-muted animate-pulse rounded w-24" />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {/* Table Header */}
                <div className="flex justify-between pb-2 border-b border-border/30">
                  <div className="h-4 bg-muted animate-pulse rounded w-24" />
                  <div className="flex space-x-4">
                    <div className="h-4 bg-muted animate-pulse rounded w-20" />
                    <div className="h-4 bg-muted animate-pulse rounded w-20" />
                  </div>
                </div>
                
                {/* Table Rows */}
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex justify-between py-2">
                    <div className="h-4 bg-muted animate-pulse rounded w-32" />
                    <div className="flex space-x-4">
                      <div className="h-4 bg-muted animate-pulse rounded w-16" />
                      <div className="h-4 bg-muted animate-pulse rounded w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insights Skeleton */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="h-5 bg-muted animate-pulse rounded w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start space-x-2">
                <div className="h-2 w-2 bg-muted animate-pulse rounded-full mt-2" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted animate-pulse rounded w-full" />
                  <div className="h-3 bg-muted animate-pulse rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
