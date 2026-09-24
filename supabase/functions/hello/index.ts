import { withSupabase } from 'npm:@supabase/server'

export default {
  fetch: withSupabase({ auth: 'user' }, async (_req, ctx) => {
    return Response.json({
      message: 'Hello from BrewTrack',
      userId: ctx.userClaims.sub,
    })
  }),
}
