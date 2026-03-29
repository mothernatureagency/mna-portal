import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { ensureSchema, query } from '@/lib/db';

type Project = {
  id: string;
  name: string;
  client_name: string | null;
  created_at: string;
};

type Task = {
  id: string;
  project_id: string;
  title: string;
  role: string;
  status: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
};

type Content = {
  id: string;
  project_id: string;
  post_date: string;
  platform: string;
  content_type: string | null;
  title: string | null;
  status: string;
  assigned_role: string | null;
  created_at: string;
};

const ROLES = ['Social Media Manager', 'Project Manager', 'Admin', 'Client'] as const;
const CONTENT_STATUSES = ['Draft', 'In Review', 'Approved', 'Scheduled', 'Done'] as const;

function formatDate(d?: string | null) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return d;
  }
}

async function getData() {
  await ensureSchema();
  const { rows: projects } = await query<Project>(
    `select id, name, client_name, created_at from projects order by created_at desc`
  );

  const { rows: tasks } = await query<Task>(
    `select id, project_id, title, role, status, due_date, notes, created_at from tasks order by created_at desc`
  );

  const { rows: content } = await query<Content>(
    `select id, project_id, post_date, platform, content_type, title, status, assigned_role, created_at from content_calendar order by post_date desc`
  );

  return { projects, tasks, content };
}

async function createProject(formData: FormData) {
  'use server';

  const name = formData.get('name')?.toString().trim();
  const clientName = formData.get('client_name')?.toString().trim() || null;

  if (!name) return;

  await query(
    `insert into projects (name, client_name) values ($1, $2)`
  , [name, clientName]);

  // Seed a default checklist template
  const checklist = [
    { title: 'Kickoff call scheduled', role: 'Project Manager', notes: '' },
    { title: 'Collect brand assets + guidelines', role: 'Admin', notes: '' },
    { title: 'Define weekly content themes', role: 'Social Media Manager', notes: '' },
    { title: 'Approval process + deadlines set', role: 'Project Manager', notes: '' },
    { title: 'Client assets / testimonials requested', role: 'Client', notes: '' },
  ];
  for (const item of checklist) {
    await query(
      `insert into tasks (project_id, title, role, notes) values ((select id from projects where name=$1 order by created_at desc limit 1), $2, $3, $4)`,
      [name, item.title, item.role, item.notes]
    );
  }

  revalidatePath('/planner');
}

async function addTask(formData: FormData) {
  'use server';

  const projectId = formData.get('project_id')?.toString();
  const title = formData.get('title')?.toString().trim();
  const role = formData.get('role')?.toString();
  const due = formData.get('due_date')?.toString() || null;
  const notes = formData.get('notes')?.toString().trim() || null;

  if (!projectId || !title || !role) return;

  await query(
    `insert into tasks (project_id, title, role, due_date, notes) values ($1, $2, $3, $4, $5)`,
    [projectId, title, role, due, notes]
  );

  revalidatePath('/planner');
}

async function addContent(formData: FormData) {
  'use server';

  const projectId = formData.get('project_id')?.toString();
  const postDate = formData.get('post_date')?.toString();
  const platform = formData.get('platform')?.toString().trim();
  const contentType = formData.get('content_type')?.toString().trim() || null;
  const title = formData.get('title')?.toString().trim() || null;
  const assignedRole = formData.get('assigned_role')?.toString() || null;

  if (!projectId || !postDate || !platform) return;

  await query(
    `insert into content_calendar (project_id, post_date, platform, content_type, title, assigned_role) values ($1, $2, $3, $4, $5, $6)`,
    [projectId, postDate, platform, contentType, title, assignedRole]
  );

  revalidatePath('/planner');
}

export default async function PlannerPage() {
  const { projects, tasks, content } = await getData();

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Marketing Planner</h1>
          <p className="text-sm text-muted-foreground">
            Create projects, assign checklists by role, and plan content by platform.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to dashboard
        </Link>
      </div>

      {/* Create project */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="border rounded-xl p-4">
          <h2 className="font-medium mb-3">Create project</h2>
          <form action={createProject} className="space-y-3">
            <div>
              <label className="text-sm">Project name</label>
              <input name="name" className="w-full mt-1 border rounded-md p-2" />
            </div>
            <div>
              <label className="text-sm">Client name (optional)</label>
              <input name="client_name" className="w-full mt-1 border rounded-md p-2" />
            </div>
            <button
              type="submit"
              className="w-full bg-black text-white rounded-md py-2 text-sm"
            >
              Create + seed checklist
            </button>
          </form>
        </div>

        {/* Add task */}
        <div className="border rounded-xl p-4">
          <h2 className="font-medium mb-3">Add checklist task</h2>
          <form action={addTask} className="space-y-3">
            <div>
              <label className="text-sm">Project</label>
              <select name="project_id" className="w-full mt-1 border rounded-md p-2">
                <option value="">Select…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm">Title</label>
              <input name="title" className="w-full mt-1 border rounded-md p-2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Role</label>
                <select name="role" className="w-full mt-1 border rounded-md p-2">
                  <option value="">Select…</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm">Due date</label>
                <input
                  type="date"
                  name="due_date"
                  className="w-full mt-1 border rounded-md p-2"
                />
              </div>
            </div>
            <div>
              <label className="text-sm">Notes</label>
              <textarea name="notes" className="w-full mt-1 border rounded-md p-2" rows={2} />
            </div>
            <button
              type="submit"
              className="w-full bg-black text-white rounded-md py-2 text-sm"
            >
              Add task
            </button>
          </form>
        </div>
      </div>

      {/* Add content */}
      <div className="border rounded-xl p-4 mb-8">
        <h2 className="font-medium mb-3">Add content calendar entry</h2>
        <form action={addContent} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="col-span-1">
            <label className="text-sm">Project</label>
            <select name="project_id" className="w-full mt-1 border rounded-md p-2">
              <option value="">Select…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm">Post date</label>
            <input type="date" name="post_date" className="w-full mt-1 border rounded-md p-2" />
          </div>
          <div>
            <label className="text-sm">Platform</label>
            <input name="platform" placeholder="IG / FB / TikTok / LI" className="w-full mt-1 border rounded-md p-2" />
          </div>
          <div>
            <label className="text-sm">Assigned role</label>
            <select name="assigned_role" className="w-full mt-1 border rounded-md p-2">
              <option value="">None</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm">Content type</label>
            <input name="content_type" placeholder="Reel / Carousel / Blog" className="w-full mt-1 border rounded-md p-2" />
          </div>
          <div className="col-span-2">
            <label className="text-sm">Title</label>
            <input name="title" placeholder="Draft headline" className="w-full mt-1 border rounded-md p-2" />
          </div>
          <div className="col-span-4">
            <button type="submit" className="w-full bg-black text-white rounded-md py-2 text-sm">
              Add content
            </button>
          </div>
        </form>
      </div>

      {/* Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-xl p-4">
          <h2 className="font-medium mb-3">Projects</h2>
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id} className="border rounded-md p-3">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.client_name ? `${p.client_name} · ` : ''}
                  Created {formatDate(p.created_at)}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="border rounded-xl p-4">
          <h2 className="font-medium mb-3">Checklist (latest)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-2">Title</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.slice(0, 12).map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="py-2">{t.title}</td>
                  <td className="py-2 text-muted-foreground">{t.role}</td>
                  <td className="py-2 text-muted-foreground">{formatDate(t.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border rounded-xl p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Content calendar (latest)</h2>
            <div className="text-xs text-muted-foreground">status defaults to Draft</div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-2">Date</th>
                <th className="pb-2">Platform</th>
                <th className="pb-2">Title</th>
                <th className="pb-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {content.slice(0, 20).map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="py-2">{formatDate(c.post_date)}</td>
                  <td className="py-2 text-muted-foreground">{c.platform}</td>
                  <td className="py-2">{c.title ?? ''}</td>
                  <td className="py-2 text-muted-foreground">{c.assigned_role ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 text-xs text-muted-foreground">
            AI buttons will be wired in later (cost-controlled): generate content themes, captions, and weekly calendar drafts.
          </div>
        </div>
      </div>
    </div>
  );
}
