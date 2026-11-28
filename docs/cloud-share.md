# Share projects with your own Cloudflare R2

This optional path keeps the Web Sampler site static while each user owns the
Worker, R2 bucket, upload key, file retention, and any usage charges. The
browser sends the selected project only to that user's Worker. R2 credentials
stay in Cloudflare and are never placed in this repository or the web page.

## One-time setup (Cloudflare dashboard)

1. Create a **private R2 bucket** in your Cloudflare account.
2. Create a Worker on `workers.dev` and paste `cloudflare/share-worker.js`.
3. Add an R2 bucket binding named `PROJECTS` pointing at the private bucket.
4. Add a Worker secret named `UPLOAD_TOKEN`. Use a long random value; never put
   R2 access keys in this secret or in the browser. The page asks for this
   upload key when sharing.
5. Deploy the Worker and copy its HTTPS `workers.dev` URL.
6. In R2, add a lifecycle rule for the `share/` prefix to delete objects after
   one day. The Worker stops accepting downloads at each link's 1/6/24-hour
   expiry even if lifecycle cleanup has not run yet.

The Worker accepts only one authenticated upload operation and tokenized file
downloads. It has no list, overwrite, bucket-management, or delete endpoint.
It accepts `.wav`, `.m4a`, `.json`, `.po33frame`, and `.po33.gz` files up to
128 MiB. A file's unguessable URL works as a bearer link until it expires.

## Use

Open `share.html` from the published Web Sampler site on a desktop browser,
enter your Worker URL and upload key, choose a project file, and create a QR.
Scan it from the importing device. The Worker URL is remembered in that
browser's local storage; the upload key is not. Revoke or rotate the Worker
secret if it is exposed.

On Windows PowerShell 5, a random upload key can be generated without installing
anything:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Copy the result to the Worker secret and to the share page when uploading. Keep
the secret private; rotate it in the Worker settings if it is exposed.

The local Local Hub remains the no-cloud option. It requires the computer to
run the local server and be reachable on the LAN; see [lan-hub.md](lan-hub.md).

Cloudflare R2 usage is billed to the R2 account owner. Review the current
[R2 pricing](https://developers.cloudflare.com/r2/pricing/) before enabling
the service. Lifecycle deletion is asynchronous and may take time to remove
expired objects; the Worker expiry check blocks downloads immediately.
