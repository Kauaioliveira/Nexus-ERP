import { ValidationOptions, registerDecorator } from 'class-validator';
import { isValidCpfOrCnpj } from '../../modules/fiscal/nfe/brazil';

// CPF (11 digitos) ou CNPJ (14) com digitos verificadores validos.
// Aceita com ou sem mascara; vazio passa (campo opcional).
export function IsCpfOrCnpj(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isCpfOrCnpj',
      target: object.constructor,
      propertyName,
      options: { message: 'CPF/CNPJ inválido.', ...options },
      validator: {
        validate: (value: unknown) =>
          value === undefined ||
          value === null ||
          value === '' ||
          (typeof value === 'string' && isValidCpfOrCnpj(value)),
      },
    });
}
