import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertRequest {
  shopId?: string;
  checkPeriod?: 'daily' | 'weekly';
  threshold?: number;
  recipientEmail?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { shopId, checkPeriod = 'daily', threshold = 10, recipientEmail }: AlertRequest = await req.json();

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    if (checkPeriod === 'daily') {
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    }

    // Build query for counting entries
    let query = supabase
      .from('goods_damaged_entries')
      .select('id, shop_id, created_at', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    if (shopId) {
      query = query.eq('shop_id', shopId);
    }

    const { data: entries, count, error: entriesError } = await query;

    if (entriesError) throw entriesError;

    // Get shop-wise counts
    const shopCounts: Record<string, { count: number; name: string }> = {};
    
    if (entries) {
      // Get shop names
      const shopIds = [...new Set(entries.map(e => e.shop_id))];
      const { data: shops } = await supabase
        .from('shops')
        .select('id, name')
        .in('id', shopIds);

      const shopNameMap = new Map(shops?.map(s => [s.id, s.name]) || []);

      for (const entry of entries) {
        if (!shopCounts[entry.shop_id]) {
          shopCounts[entry.shop_id] = {
            count: 0,
            name: shopNameMap.get(entry.shop_id) || 'Unknown Shop'
          };
        }
        shopCounts[entry.shop_id].count++;
      }
    }

    // Check which shops exceed threshold
    const alertShops = Object.entries(shopCounts)
      .filter(([_, data]) => data.count >= threshold)
      .map(([shopId, data]) => ({
        shopId,
        shopName: data.name,
        count: data.count
      }));

    if (alertShops.length === 0) {
      console.log('No shops exceeded threshold');
      return new Response(
        JSON.stringify({ 
          message: 'No alerts needed', 
          totalEntries: count,
          threshold,
          period: checkPeriod
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get admin emails if no specific recipient provided
    let emailRecipients: string[] = [];
    
    if (recipientEmail) {
      emailRecipients = [recipientEmail];
    } else {
      // Fetch admin users
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('role', 'admin');

      if (adminProfiles && adminProfiles.length > 0) {
        const { data: { users } } = await supabase.auth.admin.listUsers();
        
        const adminUserIds = new Set(adminProfiles.map(p => p.id));
        emailRecipients = users
          .filter(u => adminUserIds.has(u.id) && u.email)
          .map(u => u.email!);
      }
    }

    if (emailRecipients.length === 0) {
      console.log('No email recipients found');
      return new Response(
        JSON.stringify({ 
          message: 'No email recipients configured',
          alertShops
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Build email content
    const periodText = checkPeriod === 'daily' ? 'today' : 'this week';
    const shopAlertRows = alertShops
      .map(s => `<tr><td style="padding: 10px; border: 1px solid #ddd;">${s.shopName}</td><td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: #dc2626; font-weight: bold;">${s.count}</td></tr>`)
      .join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ GD Alert - Threshold Exceeded</h1>
        </div>
        
        <div style="background: #fff; padding: 25px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            The following shops have exceeded the threshold of <strong style="color: #7c3aed;">${threshold} GD entries</strong> ${periodText}:
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Shop Name</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">GD Count</th>
              </tr>
            </thead>
            <tbody>
              ${shopAlertRows}
            </tbody>
          </table>
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; font-size: 14px;">
              <strong>Action Required:</strong> Please review these entries and take necessary action to address the high damage rate.
            </p>
          </div>
          
          <p style="margin-top: 25px; font-size: 12px; color: #6b7280;">
            This is an automated alert from GD Tracker. Check period: ${checkPeriod === 'daily' ? 'Daily' : 'Weekly'}.
          </p>
        </div>
        
        <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 20px;">
          GD Tracker App | Automated Alert System
        </p>
      </body>
      </html>
    `;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "GD Tracker <onboarding@resend.dev>",
      to: emailRecipients,
      subject: `⚠️ GD Alert: ${alertShops.length} shop(s) exceeded threshold ${periodText}`,
      html: emailHtml,
    });

    console.log("Alert email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Alert sent to ${emailRecipients.length} recipient(s)`,
        alertShops,
        totalEntries: count,
        threshold,
        period: checkPeriod,
        emailResponse
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-gd-alert function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
