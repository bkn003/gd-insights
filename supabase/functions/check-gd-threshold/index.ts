import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function is meant to be called by a cron job to check thresholds automatically
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured, skipping email alerts');
      return new Response(
        JSON.stringify({ message: 'Email alerts not configured' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get alert settings (default: 10 entries daily)
    const DAILY_THRESHOLD = 10;
    const WEEKLY_THRESHOLD = 50;

    // Calculate today's start
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate week start (last 7 days)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    // Fetch daily entries grouped by shop
    const { data: dailyEntries, error: dailyError } = await supabase
      .from('goods_damaged_entries')
      .select('shop_id')
      .gte('created_at', today.toISOString());

    if (dailyError) throw dailyError;

    // Fetch weekly entries grouped by shop
    const { data: weeklyEntries, error: weeklyError } = await supabase
      .from('goods_damaged_entries')
      .select('shop_id')
      .gte('created_at', weekStart.toISOString());

    if (weeklyError) throw weeklyError;

    // Count by shop
    const dailyCounts: Record<string, number> = {};
    const weeklyCounts: Record<string, number> = {};

    dailyEntries?.forEach(e => {
      dailyCounts[e.shop_id] = (dailyCounts[e.shop_id] || 0) + 1;
    });

    weeklyEntries?.forEach(e => {
      weeklyCounts[e.shop_id] = (weeklyCounts[e.shop_id] || 0) + 1;
    });

    // Get shop names
    const allShopIds = [...new Set([...Object.keys(dailyCounts), ...Object.keys(weeklyCounts)])];
    
    if (allShopIds.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No entries to check' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: shops } = await supabase
      .from('shops')
      .select('id, name')
      .in('id', allShopIds);

    const shopNameMap = new Map(shops?.map(s => [s.id, s.name]) || []);

    // Check thresholds
    const dailyAlerts = Object.entries(dailyCounts)
      .filter(([_, count]) => count >= DAILY_THRESHOLD)
      .map(([shopId, count]) => ({
        shopName: shopNameMap.get(shopId) || 'Unknown',
        count,
        type: 'daily' as const
      }));

    const weeklyAlerts = Object.entries(weeklyCounts)
      .filter(([_, count]) => count >= WEEKLY_THRESHOLD)
      .map(([shopId, count]) => ({
        shopName: shopNameMap.get(shopId) || 'Unknown',
        count,
        type: 'weekly' as const
      }));

    const allAlerts = [...dailyAlerts, ...weeklyAlerts];

    if (allAlerts.length === 0) {
      console.log('No threshold exceeded');
      return new Response(
        JSON.stringify({ 
          message: 'No alerts needed',
          dailyThreshold: DAILY_THRESHOLD,
          weeklyThreshold: WEEKLY_THRESHOLD
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get admin emails
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (!adminProfiles || adminProfiles.length === 0) {
      console.log('No admin users found');
      return new Response(
        JSON.stringify({ message: 'No admin users to notify', alerts: allAlerts }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: { users } } = await supabase.auth.admin.listUsers();
    const adminUserIds = new Set(adminProfiles.map(p => p.id));
    const adminEmails = users
      .filter(u => adminUserIds.has(u.id) && u.email)
      .map(u => u.email!);

    if (adminEmails.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No admin emails found', alerts: allAlerts }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build email
    const alertRows = allAlerts
      .map(a => `<tr>
        <td style="padding: 10px; border: 1px solid #ddd;">${a.shopName}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: #dc2626; font-weight: bold;">${a.count}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${a.type === 'daily' ? 'Daily' : 'Weekly'}</td>
      </tr>`)
      .join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #f87171 100%); padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🚨 GD Threshold Alert</h1>
        </div>
        
        <div style="background: #fff; padding: 25px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
          <p>The following shops have exceeded their GD entry thresholds:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; border: 1px solid #ddd;">Shop</th>
                <th style="padding: 12px; border: 1px solid #ddd;">Count</th>
                <th style="padding: 12px; border: 1px solid #ddd;">Period</th>
              </tr>
            </thead>
            <tbody>${alertRows}</tbody>
          </table>
          
          <p style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <strong>Thresholds:</strong> Daily: ${DAILY_THRESHOLD} | Weekly: ${WEEKLY_THRESHOLD}
          </p>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: "GD Tracker <onboarding@resend.dev>",
      to: adminEmails,
      subject: `🚨 GD Alert: ${allAlerts.length} threshold(s) exceeded`,
      html: emailHtml,
    });

    console.log(`Alert sent to ${adminEmails.length} admins for ${allAlerts.length} alerts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alertsSent: allAlerts.length,
        recipients: adminEmails.length 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
