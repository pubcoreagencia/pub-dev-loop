import { defaultAgentRegistry, AgentRegistry } from './registry.js';
import type { AgentDefinition, AgentDepartment } from './types.js';

export interface HumanCeo {
  type: 'HUMAN';
  role: 'CEO';
  title?: string;
}

export interface DepartmentStructure {
  name: AgentDepartment;
  agentIds: string[];
  agents: AgentDefinition[];
}

export interface OrganizationStructure {
  ceo: HumanCeo;
  chiefOfStaff: AgentDefinition;
  departments: DepartmentStructure[];
  agents: AgentDefinition[];
}

export class OfficeOrganization {
  constructor(private readonly registry: AgentRegistry = defaultAgentRegistry) {}

  /**
   * Return the static representation of the human CEO (operator).
   */
  getCeo(): HumanCeo {
    return {
      type: 'HUMAN',
      role: 'CEO',
    };
  }

  /**
   * Retrieve the Chief of Staff agent definition.
   */
  getChiefOfStaff(): AgentDefinition {
    const cos = this.registry.getAgent('chief-of-staff');
    if (!cos) {
      throw new Error('Chief of Staff is not registered in the Agent Registry');
    }
    return cos;
  }

  /**
   * Return all unique departments derived dynamically from the registered agents.
   */
  getDepartments(): DepartmentStructure[] {
    const agents = this.registry.listAgents();
    const departmentOrder: AgentDepartment[] = ['EXECUTIVE', 'ENGINEERING', 'QA'];

    return departmentOrder.map(dept => {
      const deptAgents = agents.filter(a => a.department === dept);
      return {
        name: dept,
        agentIds: deptAgents.map(a => a.id),
        agents: deptAgents,
      };
    });
  }

  /**
   * Retrieve all agents belonging to a specific department.
   */
  getDepartmentAgents(department: AgentDepartment): AgentDefinition[] {
    return this.registry.getAgentsByDepartment(department);
  }

  /**
   * Retrieve all agents who report directly to the specified agent ID.
   */
  getDirectReports(agentId: string): AgentDefinition[] {
    return this.registry.listAgents().filter(a => a.reportsTo === agentId);
  }

  /**
   * Build the complete organizational structure derived from the registry.
   */
  getOrganization(): OrganizationStructure {
    return {
      ceo: this.getCeo(),
      chiefOfStaff: this.getChiefOfStaff(),
      departments: this.getDepartments(),
      agents: this.registry.listAgents(),
    };
  }
}

/** Global singleton instance */
export const defaultOfficeOrganization = new OfficeOrganization(defaultAgentRegistry);

/** Convenience helper functions delegating to default organization instance */
export const getCeo = () => defaultOfficeOrganization.getCeo();
export const getChiefOfStaff = () => defaultOfficeOrganization.getChiefOfStaff();
export const getDepartments = () => defaultOfficeOrganization.getDepartments();
export const getDepartmentAgents = (dept: AgentDepartment) => defaultOfficeOrganization.getDepartmentAgents(dept);
export const getDirectReports = (agentId: string) => defaultOfficeOrganization.getDirectReports(agentId);
export const getOrganization = () => defaultOfficeOrganization.getOrganization();
