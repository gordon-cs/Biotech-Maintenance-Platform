import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Missing token' }, { status: 401 })
    const token = authHeader.split(' ')[1]

    // verify token with the service client
    const { data: { user }, error: userErr } = await serviceClient.auth.getUser(token)
    if (userErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const body = await req.json()
    const userId = user.id

    // upsert profile
    const profile = {
      id: userId,
      role: body.role ?? null,
      full_name: body.full_name ?? null,
      phone: body.phone ?? null,
      email: user.email ?? null,
    }

    const { error: pErr } = await serviceClient.from('profiles').upsert(profile)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

    if (body.role === 'lab') {
      const lab = {
        manager_id: userId,
        name: body.lab?.name ?? null,
        address: body.lab?.address ?? null,
        city: body.lab?.city ?? null,
        state: body.lab?.state ?? null,
        zipcode: body.lab?.zipcode ?? null,
      }
      const { error: lErr } = await serviceClient.from('labs').insert(lab)
      if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
    }

    if (body.role === 'technician') {
      const tech = {
        profile_id: userId,
        experience: body.tech?.experience ?? null,
        bio: body.tech?.bio ?? null,
      }
      const { error: tErr } = await serviceClient.from('technicians').insert(tech)
      if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 })
  }
}
