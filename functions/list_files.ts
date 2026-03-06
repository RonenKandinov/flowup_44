import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const cwd = Deno.cwd();
        const files = [];
        for await (const dirEntry of Deno.readDir(cwd)) {
            files.push(dirEntry.name);
        }
        return Response.json({ cwd, files });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});