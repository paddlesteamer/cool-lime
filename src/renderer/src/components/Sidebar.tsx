import type { ProjectManifest, ProjectRef } from '@shared/types'

interface Props { project: ProjectRef; manifest: ProjectManifest; subtopic: string | null; opened: string[]; onSelect: (s: string) => void; onAdd: () => void }

export default function Sidebar({ project, manifest, subtopic, opened, onSelect, onAdd }: Props) {
  return (
    <div className="sidebar">
      <h3>Project</h3>
      <div className="item active" title={project.path} onClick={() => window.lime.projects.revealInFinder(project.path)}>{project.name}</div>
      <h3>Subtopics <button className="ghost" title="Add subtopic" onClick={onAdd}>+</button></h3>
      {manifest.subtopics.map((s) => (
        <div key={s} className={`item ${s === subtopic ? 'active' : ''}`} onClick={() => onSelect(s)}>
          <span className={`dot ${opened.includes(s) ? 'live' : ''}`} />{s}
        </div>
      ))}
      {manifest.subtopics.length === 0 && <div className="item" onClick={onAdd}>+ add your first subtopic</div>}
      <div className="spacer" />
      <h3>Context</h3>
      <div className="item" onClick={() => window.lime.projects.revealInFinder(`${project.path}/CONTEXT.md`)}>CONTEXT.md</div>
      <div className="item" onClick={() => window.lime.projects.revealInFinder(`${project.path}/context`)}>context/ (sources)</div>
    </div>
  )
}
