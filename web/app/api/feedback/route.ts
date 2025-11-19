import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, email, metadata } = body;

    // Log feedback to console for now
    console.log('Feedback received:', {
      message,
      email,
      metadata,
      timestamp: new Date().toISOString(),
    });

    // Optional: Send to Slack webhook if configured
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: `*New Feedback Received*\n\n*From:* ${email || 'Anonymous'}\n*Message:* ${message}\n*Page:* ${metadata?.page || 'Unknown'}\n*Scan ID:* ${metadata?.scanId || 'N/A'}`,
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
