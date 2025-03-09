import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Trash2 } from 'lucide-react';
import { Project } from '../../types';

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDelete }) => {
  const formattedDate = new Date(project.created_at).toLocaleDateString();

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">{project.name}</h3>
        {project.description && (
          <p className="mt-1 text-sm text-gray-500">{project.description}</p>
        )}
        <div className="mt-3 flex items-center text-sm text-gray-500">
          <Calendar className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
          <span>Created on {formattedDate}</span>
        </div>
      </div>
      <div className="bg-gray-50 px-4 py-4 sm:px-6 flex justify-between">
        <Link
          to={`/projects/${project.id}`}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          View / Manage
        </Link>
        <button
          onClick={() => onDelete(project.id)}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </button>
      </div>
    </div>
  );
};

export default ProjectCard;