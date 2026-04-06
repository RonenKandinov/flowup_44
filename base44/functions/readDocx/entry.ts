import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const res = await base44.integrations.Core.ExtractDataFromUploadedFile({
            file_url: "https://media.base44.com/files/public/6952b136798aa2d444ccb308/5a73abf1e_.docx",
            json_schema: {
                type: "object",
                properties: {
                    content: { type: "string" }
                }
            }
        });
        
        return Response.json(res);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});