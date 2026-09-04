export type EstudianteBasico = {
  id: number;
  codigo: string;
  dni: string;
  nombres: string;
  apellidos: string;
  grado: string;
  seccion: string;
  nombreTutor?: string;
  whatsapp?: string;
  estado?: boolean;
};

export type Familia = {
  id: number;
  codigo: string;
  tutorTitular: string;
  telefonoContacto: string;
  correoContacto: string;
  estado: boolean;
  ultimoIngresoAt?: string | null;
  createdAt: string;
  updatedAt: string;
  estudiantes: EstudianteBasico[];
};

export type EstadisticasPadres = {
  totalFamilias: number;
  familiasActivas: number;
  familiasInactivas: number;
  totalEstudiantes: number;
  alumnasVinculadas: number;
  alumnasSinCodigo: number;
};
