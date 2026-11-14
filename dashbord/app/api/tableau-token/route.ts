// Server-side API route that creates a signed JWT for Tableau Connected App authentication.
// This runs only on the server so the secret credentials never reach the browser.

import { SignJWT } from "jose";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export async function GET() {

    // Pull the four credentials from server-side environment variables.
    // .trim() removes any accidental spaces around the values in .env.local.
    const clientId    = process.env.TABLEAU_CLIENT_ID?.trim();
    const secretId    = process.env.TABLEAU_SECRET_ID?.trim();
    const secretValue = process.env.TABLEAU_SECRET_VALUE?.trim();
    const userEmail   = process.env.TABLEAU_USER_EMAIL?.trim();

    // If any credential is missing, return a 500 error instead of crashing
    if (!clientId || !secretId || !secretValue || !userEmail) {
        return NextResponse.json(
            { error: "Missing Tableau credentials — check your .env.local file" },
            { status: 500 }
        );
    }

    // Convert the secret string to bytes — jose requires this format for HMAC signing
    const secret = new TextEncoder().encode(secretValue);

    // Build and sign the JWT with the exact claims Tableau Connected Apps require
    const token = await new SignJWT({
            // scp tells Tableau what this token is allowed to do (embed views)
            scp: ["tableau:views:embed"],
        })
        .setProtectedHeader({
            // HS256 = HMAC-SHA256, the signing algorithm Tableau requires
            alg: "HS256",
            // kid = Secret ID — tells Tableau which key was used to sign this token
            kid: secretId,
        })
        // iss = issuer — identifies your Connected App to Tableau
        .setIssuer(clientId)
        // sub = subject — the Tableau user this token belongs to (your email)
        .setSubject(userEmail)
        // aud = audience — always the string "tableau" for Connected Apps
        .setAudience("tableau")
        // exp = expiration — token is only valid for 10 minutes from now
        .setExpirationTime("10m")
        // jti = JWT ID — a unique ID so Tableau can reject replayed tokens
        .setJti(randomUUID())
        .sign(secret);

    // Send the signed token back as JSON — the TableauEmbed component will use it
    return NextResponse.json({ token });
}
