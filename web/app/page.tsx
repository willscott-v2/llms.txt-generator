'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [domain, setDomain] = useState('');
  const [topics, setTopics] = useState('');
  const [priorityUrls, setPriorityUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain,
          topics: topics.split(',').map(t => t.trim()).filter(t => t),
          priorityUrls: priorityUrls.split('\n').map(u => u.trim()).filter(u => u),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start generation');
      }

      const { scanId } = await response.json();
      router.push(`/scan/${scanId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
              LLMS.txt Generator
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Automatically generate citation-worthy LLMS.txt files for your website
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Domain Input */}
              <div>
                <label htmlFor="domain" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Website Domain
                </label>
                <input
                  type="text"
                  id="domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="https://example.com"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>

              {/* Topics Input */}
              <div>
                <label htmlFor="topics" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Topics (Optional)
                </label>
                <input
                  type="text"
                  id="topics"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="Higher Education Marketing, Healthcare Marketing, SEO"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Comma-separated list of topics to prioritize
                </p>
              </div>

              {/* Priority URLs Input */}
              <div>
                <label htmlFor="priorityUrls" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority URLs (Optional)
                </label>
                <textarea
                  id="priorityUrls"
                  value={priorityUrls}
                  onChange={(e) => setPriorityUrls(e.target.value)}
                  placeholder="https://example.com/important-page&#10;https://example.com/case-study&#10;https://example.com/whitepaper"
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-vertical"
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  One URL per line. These pages will be guaranteed inclusion in the output with their citation scores.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Starting Generation...
                  </span>
                ) : (
                  'Generate LLMS.txt'
                )}
              </button>
            </form>

            {/* Info Section */}
            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                What happens next?
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-start">
                  <span className="mr-2">1.</span>
                  <span>Crawl your website and analyze content structure</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">2.</span>
                  <span>Identify topic clusters and score citation-worthiness</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">3.</span>
                  <span>Discover related third-party content (YouTube, LinkedIn, etc.)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">4.</span>
                  <span>Generate your LLMS.txt file with audit report</span>
                </li>
              </ul>
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-500">
                Typical processing time: 15-20 minutes
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
