'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GenerationStatus from '@/components/GenerationStatus';
import { Download, FileText, ExternalLink, TrendingUp, Brain } from 'lucide-react';
import FeedbackWidget from '@upstash/feedback';
import '@upstash/feedback/index.css';

interface ScanData {
  status: 'crawling' | 'analyzing' | 'discovering' | 'generating' | 'completed' | 'error';
  progress: number;
  currentStep: string;
  error?: string;
  result?: {
    llmsTxt: any;
    analysisData: {
      topics: any[];
      clusters: any[];
      hubPages: any[];
      offsiteContent: any[];
      socialProfiles: any[];
    };
  };
}

export default function ScanPage() {
  const params = useParams();
  const router = useRouter();
  const scanId = params.scanId as string;

  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!scanId) return;

    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;

    const pollStatus = async () => {
      try {
        // Add timeout to fetch (10 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`/api/generate?scanId=${scanId}`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('Failed to fetch scan status');
        }

        const data: ScanData = await response.json();
        setScanData(data);
        consecutiveErrors = 0; // Reset error counter on success

        if (data.status === 'error') {
          setError(data.error || 'Unknown error occurred');
        }
      } catch (err) {
        // Only show error if we've had multiple consecutive failures
        consecutiveErrors++;

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          setError(err instanceof Error ? err.message : 'Failed to fetch status');
        } else {
          // Log but don't show error for transient network issues
          console.log('Polling error (retrying):', err);
        }
      }
    };

    // Poll immediately
    pollStatus();

    // Then poll every 3 seconds until completed or error
    const interval = setInterval(() => {
      if (scanData?.status === 'completed' || scanData?.status === 'error') {
        clearInterval(interval);
      } else {
        pollStatus();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [scanId, scanData?.status]);

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-2xl w-full border-2 border-red-500">
          <h2 className="text-3xl font-bold text-center text-red-600 dark:text-red-400 mb-4">Error</h2>
          <p className="text-center text-gray-700 dark:text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show loading/progress state
  if (!scanData || (scanData.status !== 'completed' && scanData.status !== 'error')) {
    const validStatus = scanData?.status === 'crawling' || scanData?.status === 'analyzing' || scanData?.status === 'discovering' || scanData?.status === 'generating'
      ? scanData.status
      : 'crawling';

    return (
      <GenerationStatus
        status={validStatus}
        progress={scanData?.progress || 0}
        currentStep={scanData?.currentStep || 'Initializing...'}
      />
    );
  }

  // Show results
  const { result } = scanData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full mb-4">
              <FileText className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              LLMS.txt Generated Successfully!
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Your citation-worthy LLMS.txt file is ready for download
            </p>
          </div>

          {/* Download Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Download Your Files</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => {
                  const blob = new Blob([result?.llmsTxt], {
                    type: 'text/plain',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'llms.txt';
                  a.click();
                }}
                className="flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-lg transition"
              >
                <Download size={20} />
                Download LLMS.txt
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(result?.analysisData, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'analysis-data.json';
                  a.click();
                }}
                className="flex items-center justify-center gap-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-4 px-6 rounded-lg transition"
              >
                <Download size={20} />
                Download Analysis Data
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <StatCard
              icon={Brain}
              label="Topics Identified"
              value={result?.analysisData.topics.length || 0}
              color="indigo"
            />
            <StatCard
              icon={FileText}
              label="Hub Pages"
              value={result?.analysisData.hubPages.length || 0}
              color="purple"
            />
            <StatCard
              icon={ExternalLink}
              label="Off-site Resources"
              value={result?.analysisData.offsiteContent.length || 0}
              color="blue"
            />
            <StatCard
              icon={TrendingUp}
              label="Social Profiles"
              value={result?.analysisData.socialProfiles.length || 0}
              color="green"
            />
          </div>

          {/* Topics */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Identified Topics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result?.analysisData.topics.map((topic: any, index: number) => (
                <div
                  key={index}
                  className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700"
                >
                  <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">{topic.name}</h3>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-2">{topic.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {topic.keywords.slice(0, 3).map((keyword: string, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 text-xs rounded"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Hub Pages */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Top Hub Pages</h2>
            <div className="space-y-4">
              {result?.analysisData.hubPages.slice(0, 5).map((page: any, index: number) => (
                <div
                  key={index}
                  className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{page.title}</h3>
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm font-medium rounded">
                      {page.score.total}/100
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{page.clusterName}</p>
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    View Page <ExternalLink size={14} />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Back Button */}
          <div className="text-center">
            <button
              onClick={() => router.push('/')}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition"
            >
              Generate Another LLMS.txt
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Widget */}
      <FeedbackWidget
        type="full"
        user="anonymous"
        metadata={{ scanId, page: 'results' }}
        themeColor="#4f46e5"
        apiPath="/api/feedback"
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) {
  const colorClasses = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400',
    purple: 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400',
    blue: 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className={`inline-flex p-3 rounded-lg mb-4 ${colorClasses[color as keyof typeof colorClasses]}`}>
        <Icon size={24} />
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
    </div>
  );
}
