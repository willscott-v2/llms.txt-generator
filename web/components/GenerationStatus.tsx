'use client';

import { Loader2, FileText, Brain, Search, Sparkles } from 'lucide-react';

interface GenerationStatusProps {
  status: 'crawling' | 'analyzing' | 'discovering' | 'generating';
  progress: number;
  currentStep: string;
}

const statusConfig = {
  crawling: {
    icon: Search,
    color: '#4F46E5',
    label: 'Crawling',
  },
  analyzing: {
    icon: Brain,
    color: '#7C3AED',
    label: 'Analyzing',
  },
  discovering: {
    icon: Sparkles,
    color: '#2563EB',
    label: 'Discovering',
  },
  generating: {
    icon: FileText,
    color: '#059669',
    label: 'Generating',
  },
};

export default function GenerationStatus({ status, progress, currentStep }: GenerationStatusProps) {
  const config = statusConfig[status];
  const IconComponent = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-2xl w-full border-2 border-indigo-500">
        {/* Loading Animation */}
        <div className="flex justify-center mb-8">
          <div className="relative w-24 h-24">
            <Loader2
              size={96}
              className="absolute inset-0 text-indigo-600 animate-spin"
              style={{ animationDuration: '2s' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center">
                <IconComponent size={32} className="text-indigo-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Status Text */}
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">
          Generating Your LLMS.txt File...
        </h2>

        {/* Current Step */}
        <div className="mb-8 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700">
          <p className="text-center text-lg text-indigo-900 dark:text-indigo-100 font-medium">
            {currentStep}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progress</span>
            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Progress Steps */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {(['crawling', 'analyzing', 'discovering', 'generating'] as const).map((step) => {
            const stepConfig = statusConfig[step];
            const StepIcon = stepConfig.icon;
            const isActive = step === status;
            const isCompleted = getStepOrder(step) < getStepOrder(status);

            return (
              <div key={step} className="flex flex-col items-center gap-2">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all ${
                    isActive
                      ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-600 dark:border-indigo-400 scale-110'
                      : isCompleted
                      ? 'bg-green-100 dark:bg-green-900 border-green-600 dark:border-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <StepIcon
                    size={24}
                    className={
                      isActive
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : isCompleted
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }
                  />
                </div>
                <span
                  className={`text-xs font-medium text-center ${
                    isActive
                      ? 'text-indigo-900 dark:text-indigo-100'
                      : isCompleted
                      ? 'text-green-900 dark:text-green-100'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {stepConfig.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            This process typically takes 15-20 minutes. We're crawling your website, analyzing content
            structure, discovering related resources, and generating a citation-worthy LLMS.txt file.
          </p>
        </div>

        {/* Powered by */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Powered by <strong className="text-indigo-600 dark:text-indigo-400">Search Influence</strong> - AI SEO Experts
          </p>
        </div>
      </div>
    </div>
  );
}

function getStepOrder(status: 'crawling' | 'analyzing' | 'discovering' | 'generating'): number {
  const order = { crawling: 0, analyzing: 1, discovering: 2, generating: 3 };
  return order[status];
}
