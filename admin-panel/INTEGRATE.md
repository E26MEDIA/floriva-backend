# Add Blog to Floriva Admin (`admin.florivagifts.com`)

The live admin already has **Banner & Images** (`/content`) with photo upload, ALT, and full-width placement. Blog uses the same APIs and the same look — it is just not wired into that React app yet.

`floriva-admin` is not in this backend repo. Add the page on the machine where you build admin (`E:\Floriva\Admin`).

## 1. Copy the page

Copy `admin-panel/Blog.jsx` from this backend repo into the admin app, for example:

```text
E:\Floriva\Admin\src\pages\Blog.jsx
```

If your pages live under `src/components`, put it there instead.

## 2. Sidebar (next to Banner & Images)

Find the nav item:

```js
{ name: "Banner & Images", href: "/content"
```

Add immediately after it:

```js
{ name: "Blog", href: "/blog", icon: FileText },
```

Import the icon if needed:

```js
import { FileText } from "lucide-react";
```

## 3. Route (same file as `path: "content"`)

Next to:

```js
path: "content"
```

or

```js
path: "banner-images"
```

add:

```js
<Route path="blog" element={<Blog />} />
```

and:

```js
import Blog from "./pages/Blog";
```

(Adjust the import path to wherever you copied the file.)

## 4. Build and upload

Same as other admin updates:

```powershell
cd E:\Floriva
.\scripts\build-admin.ps1
```

Upload `Admin\dist\` to `admin.florivagifts.com`.

Then: **Admin → Blog** (same login, same sidebar as Banner & Images).

## APIs this page uses (already on the backend)

- `GET/POST /api/admin/blog`
- `PUT/DELETE /api/admin/blog/:id`
- `POST /api/admin/blog/images` (placement: left / center / right / full)
