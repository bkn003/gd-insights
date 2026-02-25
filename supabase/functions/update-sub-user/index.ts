import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const callerId = claimsData.claims.sub as string

    // Check caller is admin
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, admin_id, status')
      .eq('id', callerId)
      .single()

    if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'super_admin')) {
      return new Response(JSON.stringify({ error: 'Only admins can update sub-users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if ((callerProfile as any).status !== 'active') {
      return new Response(JSON.stringify({ error: 'Your account is paused' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { user_id, email, password, action } = body

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verify the target user belongs to the caller's org
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('admin_id, role')
      .eq('id', user_id)
      .single()

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Admin can only manage their own sub-users
    if (callerProfile.role === 'admin' && targetProfile.admin_id !== callerId) {
      return new Response(JSON.stringify({ error: 'Cannot modify users outside your organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Handle pause/unpause action
    if (action === 'pause' || action === 'unpause') {
      const newStatus = action === 'pause' ? 'paused' : 'active'
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', user_id)

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // If pausing, sign out the user to force logout
      if (action === 'pause') {
        await supabaseAdmin.auth.admin.signOut(user_id, 'global')
      }

      return new Response(JSON.stringify({ success: true, status: newStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Handle email/password update
    const updates: any = {}
    if (email) updates.email = email
    if (password) updates.password = password

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'No updates provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, updates)

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update email in profiles table too
    if (email) {
      await supabaseAdmin
        .from('profiles')
        .update({ email })
        .eq('id', user_id)
    }

    // Force sign out the user so they must re-login with new credentials
    await supabaseAdmin.auth.admin.signOut(user_id, 'global')

    return new Response(JSON.stringify({ success: true, credentialsChanged: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error updating sub-user:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
