import { useCallback, useEffect, useState } from 'react'
import type { ProjectManifest, ProjectRef } from '@shared/types'
import StartScreen from './components/StartScreen'
import Sidebar from './components/Sidebar'
import TerminalPane from './components/TerminalPane'
import FilePane from './components/FilePane'
import ProjectSettings from './components/ProjectSettings'

export default function App() {
  const [project, setProject] = useState<ProjectRef | null>(null)
  const [manifest, setManifest] = useState<ProjectManifest | null>(null)
  const [subtopic, setSubtopic] = useState<string | null>(null)
  const [opened, setOpened] = useState<string[]>([]) // subtopics with live terminals
  const [settingsOpen, setSettingsOpen] = useState(false)

  const open = useCallback(async (path: string) => {
    const { ref, manifest } = await window.lime.projects.open(path)
    setProject(ref); setManifest(manifest); setSubtopic(manifest.subtopics[0] ?? null); setOpened([])
  }, [])

  const refresh = useCallback(async () => { if (project) setManifest(await window.lime.projects.manifest(project.path)) }, [project])

  const addSubtopic = async () => {
    const name = prompt('Subtopic name')
    if (!name || !project) return
    const m = await window.lime.projects.addSubtopic(project.path, name)
    setManifest(m); setSubtopic(m.subtopics[m.subtopics.length - 1])
  }

  useEffect(() => { if (subtopic && !opened.includes(subtopic)) setOpened((o) => [...o, subtopic]) }, [subtopic])

  const closeProject = () => { opened.forEach((s) => window.lime.pty.kill(`${project!.path}/${s}`)); window.lime.fs.unwatch(); setProject(null); setManifest(null); setSubtopic(null); setOpened([]) }

  return (
    <>
      <div className="titlebar">
        <b>Cool-Lime</b>{project ? <span>{project.name}{subtopic ? ` / ${subtopic}` : ''}</span> : <span>harness for Claude Code</span>}
        {project && <div className="right"><button className="ghost" onClick={() => setSettingsOpen(true)}>Project settings</button><button className="ghost" onClick={closeProject}>Close project</button></div>}
      </div>
      {!project || !manifest ? <StartScreen onOpen={open} /> : (
        <div className="layout">
          <Sidebar project={project} manifest={manifest} subtopic={subtopic} opened={opened} onSelect={setSubtopic} onAdd={addSubtopic} />
          <div className="center">
            {subtopic ? <TerminalPane projectPath={project.path} opened={opened} active={subtopic} />
              : <div className="empty">No subtopics yet.<br />Add one from the sidebar to start a Claude Code session.</div>}
          </div>
          <FilePane root={subtopic ? `${project.path}/${subtopic}` : null} />
        </div>
      )}
      {settingsOpen && project && manifest && <ProjectSettings project={project} manifest={manifest} subtopic={subtopic} onClose={() => { setSettingsOpen(false); refresh() }} />}
    </>
  )
}
