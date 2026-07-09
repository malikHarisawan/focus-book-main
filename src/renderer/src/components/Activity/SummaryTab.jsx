import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import {
  Clock,
  TrendingUp,
  Award,
  Lightbulb,
  Target,
  AlertCircle,
  CheckCircle,
  MinusCircle,
  XCircle
} from 'lucide-react'

export default function SummaryTab({ summary, date }) {
  if (!summary) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">No summary data available</p>
      </div>
    )
  }

  const { overview, totalTime, productivePercentage, topActivity, categories, insights, recommendations, isEmpty, isFallback } = summary

  // Handle empty state
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium text-foreground">No Activity Data</p>
        <p className="text-sm text-muted-foreground">
          No activity was recorded for {date}
        </p>
      </div>
    )
  }

  // Get category data
  const productiveCategory = categories.find(c => c.type === 'Productive') || { apps: [], time: '0s', percentage: 0 }
  const neutralCategory = categories.find(c => c.type === 'Neutral') || { apps: [], time: '0s', percentage: 0 }
  const distractingCategory = categories.find(c => c.type === 'Distracting') || { apps: [], time: '0s', percentage: 0 }

  return (
    <div className="space-y-6 px-6 pb-6">
      {/* Fallback Warning */}
      {isFallback && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/10">
          <CardContent className="pt-4">
            <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-500">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">AI analysis unavailable. Showing basic statistics.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <p className="text-base text-foreground leading-relaxed">{overview}</p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Time */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Total Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalTime}</div>
          </CardContent>
        </Card>

        {/* Productive Percentage */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Productive Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-2">
              <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                {productivePercentage}%
              </div>
              <div className="text-sm text-muted-foreground">
                {productiveCategory.time}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Activity */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Award className="h-4 w-4 mr-2" />
              Top Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topActivity ? (
              <>
                <div className="text-base font-semibold text-foreground truncate">
                  {topActivity.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {topActivity.time} ({topActivity.percentage}%)
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center">
          Activity Breakdown
        </h3>

        {/* Productive Activities */}
        {productiveCategory.apps.length > 0 && (
          <Card className="border-green-500/20">
            <CardHeader className="pb-3 bg-green-50/50 dark:bg-green-950/10">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span className="flex items-center text-green-700 dark:text-green-500">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Productive Activities
                </span>
                <Badge variant="outline" className="border-green-500/50 text-green-700 dark:text-green-500">
                  {productiveCategory.time} ({productiveCategory.percentage}%)
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/30">
                    <TableHead className="text-muted-foreground">Application</TableHead>
                    <TableHead className="text-right text-muted-foreground">Time Spent</TableHead>
                    <TableHead className="text-right text-muted-foreground">% of Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productiveCategory.apps.map((app, idx) => (
                    <TableRow key={idx} className="border-border/30">
                      <TableCell className="font-medium text-foreground">{app.name}</TableCell>
                      <TableCell className="text-right font-mono text-primary">{app.time}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{app.percentage}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Neutral Activities */}
        {neutralCategory.apps.length > 0 && (
          <Card className="border-blue-500/20">
            <CardHeader className="pb-3 bg-blue-50/50 dark:bg-blue-950/10">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span className="flex items-center text-blue-700 dark:text-blue-500">
                  <MinusCircle className="h-5 w-5 mr-2" />
                  Neutral Activities
                </span>
                <Badge variant="outline" className="border-blue-500/50 text-blue-700 dark:text-blue-500">
                  {neutralCategory.time} ({neutralCategory.percentage}%)
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/30">
                    <TableHead className="text-muted-foreground">Application</TableHead>
                    <TableHead className="text-right text-muted-foreground">Time Spent</TableHead>
                    <TableHead className="text-right text-muted-foreground">% of Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {neutralCategory.apps.map((app, idx) => (
                    <TableRow key={idx} className="border-border/30">
                      <TableCell className="font-medium text-foreground">{app.name}</TableCell>
                      <TableCell className="text-right font-mono text-primary">{app.time}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{app.percentage}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Distracting Activities */}
        {distractingCategory.apps.length > 0 && (
          <Card className="border-red-500/20">
            <CardHeader className="pb-3 bg-red-50/50 dark:bg-red-950/10">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span className="flex items-center text-red-700 dark:text-red-500">
                  <XCircle className="h-5 w-5 mr-2" />
                  Unproductive Activities
                </span>
                <Badge variant="outline" className="border-red-500/50 text-red-700 dark:text-red-500">
                  {distractingCategory.time} ({distractingCategory.percentage}%)
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/30">
                    <TableHead className="text-muted-foreground">Application</TableHead>
                    <TableHead className="text-right text-muted-foreground">Time Spent</TableHead>
                    <TableHead className="text-right text-muted-foreground">% of Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {distractingCategory.apps.map((app, idx) => (
                    <TableRow key={idx} className="border-border/30">
                      <TableCell className="font-medium text-foreground">{app.name}</TableCell>
                      <TableCell className="text-right font-mono text-primary">{app.time}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{app.percentage}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Insights Section */}
      {insights && insights.length > 0 && (
        <Card className="border-purple-500/20 bg-purple-50/30 dark:bg-purple-950/10">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center text-purple-700 dark:text-purple-500">
              <Lightbulb className="h-5 w-5 mr-2" />
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {insights.map((insight, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span className="text-sm text-foreground">{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommendations Section */}
      {recommendations && recommendations.length > 0 && (
        <Card className="border-cyan-500/20 bg-cyan-50/30 dark:bg-cyan-950/10">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center text-cyan-700 dark:text-cyan-500">
              <Target className="h-5 w-5 mr-2" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommendations.map((recommendation, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-cyan-500 mt-1">✓</span>
                  <span className="text-sm text-foreground">{recommendation}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
