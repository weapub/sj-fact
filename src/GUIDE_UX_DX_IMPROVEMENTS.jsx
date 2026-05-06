/**
 * GUÍA DE MEJORES PRÁCTICAS - UX/DX IMPROVEMENTS
 * 
 * Referencia para usar los componentes mejorados con accesibilidad y UX consistente.
 */

// ===== EJEMPLO 1: Formulario Simple con Dirty State =====

/*
import { useState, useCallback } from 'react'
import Input from '../components/Input'
import Button from '../components/Button'
import UnsavedChangesBar from '../components/UnsavedChangesBar'
import { useFormDirty } from '../hooks/useDirtyState'

export function SimpleForm() {
  const initialData = { name: '', email: '' }
  const [formData, setFormData] = useState(initialData)
  const isDirty = useFormDirty(initialData, formData)

  const handleSave = async () => {
    // Guardar...
    setFormData({ ...formData }) // Reset dirty state
  }

  const handleDiscard = () => {
    setFormData(initialData)
  }

  return (
    <>
      <div className="space-y-4">
        <Input 
          label="Nombre"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <Input 
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        <Button onClick={handleSave}>Guardar</Button>
      </div>
      <UnsavedChangesBar 
        isDirty={isDirty}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </>
  )
}
*/

// ===== EJEMPLO 2: Input con Error (Validación) =====

/*
import Input from '../components/Input'
import { useState } from 'react'

export function InputWithValidation() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const validateEmail = (value) => {
    if (!value.includes('@')) {
      setError(true)
      setErrorMessage('El email debe contener un @')
    } else {
      setError(false)
      setErrorMessage('')
    }
  }

  return (
    <Input 
      label="Email"
      type="email"
      value={email}
      onChange={(e) => {
        setEmail(e.target.value)
        validateEmail(e.target.value)
      }}
      error={error}
      errorMessage={errorMessage}
      helper="Usa un email válido"
    />
  )
}
*/

// ===== EJEMPLO 3: Select Mejorado =====

/*
import Select from '../components/Select'
import { useState } from 'react'

export function SelectExample() {
  const [listId, setListId] = useState('')
  const [error, setError] = useState(false)

  return (
    <Select 
      label="Lista de precios"
      value={listId}
      onChange={(e) => {
        setListId(e.target.value)
        if (!e.target.value) {
          setError(true)
        } else {
          setError(false)
        }
      }}
      error={error}
      errorMessage={error ? 'Selecciona una lista' : ''}
      helper="Requerido para generar presupuestos"
    >
      <option value="">-- Selecciona --</option>
      <option value="1">General</option>
      <option value="2">Mayorista</option>
    </Select>
  )
}
*/

// ===== EJEMPLO 4: Modal Mejorado con Trap Focus =====

/*
import { useState } from 'react'
import Modal from '../components/Modal'
import Button from '../components/Button'
import Input from '../components/Input'

export function ModalExample() {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState({ name: '' })

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Abrir Modal</Button>
      <Modal 
        isOpen={isOpen}
        title="Crear nuevo cliente"
        onClose={() => setIsOpen(false)}
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setIsOpen(false)}>
              Crear
            </Button>
          </div>
        }
      >
        <Input 
          label="Nombre del cliente"
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          autoFocus
        />
      </Modal>
    </>
  )
}
*/

// ===== EJEMPLO 5: Textarea Mejorado =====

/*
import Textarea from '../components/Textarea'
import { useState } from 'react'

export function TextareaExample() {
  const [notes, setNotes] = useState('')
  const [error, setError] = useState(false)

  return (
    <Textarea 
      label="Notas"
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      error={error}
      errorMessage={error ? 'Las notas son muy largas' : ''}
      helper="Máximo 500 caracteres"
      maxLength={500}
      rows={4}
    />
  )
}
*/

// ===== EJEMPLO 6: Botones con aria-label =====

/*
import Button from '../components/Button'
import Icon from '../components/Icon'

export function ButtonExamples() {
  return (
    <div className="space-y-2">
      {/* Botón con solo icono - REQUIERE aria-label */}
      <Button 
        ariaLabel="Eliminar cliente"
        onClick={() => console.log('delete')}
      >
        🗑️
      </Button>

      {/* Botón con texto - aria-label opcional pero recomendado */}
      <Button 
        variant="primary"
        ariaLabel="Guardar cambios y cerrar"
        onClick={() => console.log('save')}
      >
        Guardar
      </Button>

      {/* Botón de peligro */}
      <Button 
        variant="danger"
        ariaLabel="Eliminar definitivamente"
        onClick={() => console.log('delete-permanent')}
      >
        Eliminar
      </Button>
    </div>
  )
}
*/

// ===== EJEMPLO 7: Toast con mejor UX =====

/*
import { useToast } from '../components/ToastContext'
import Button from '../components/Button'

export function ToastExample() {
  const toast = useToast()

  return (
    <>
      <Button onClick={() => toast.success('Guardado correctamente')}>
        Éxito
      </Button>
      <Button onClick={() => toast.error('Ocurrió un error')} variant="danger">
        Error
      </Button>
      <Button onClick={() => toast.warning('Atención: acción no reversible')} variant="warning">
        Advertencia
      </Button>
    </>
  )
}
*/

// ===== CAMBIOS PRINCIPALES =====

/*
✅ Button:
  - Nueva prop: ariaLabel (para accesibilidad)
  - KEEP: variant, size, as, className

✅ Input:
  - CAMBIO: containerClassName → solo className
  - NUEVO: error, errorMessage, para validación visual
  - NUEVO: aria-invalid, aria-describedby automáticos
  - NUEVO: autoFocus, id props

✅ Select:
  - CAMBIO: containerClassName → solo className
  - NUEVO: error, errorMessage
  - NUEVO: aria-invalid, aria-describedby automáticos
  - COMPATIBLE: children

✅ Textarea:
  - CAMBIO: containerClassName → solo className
  - NUEVO: error, errorMessage
  - NUEVO: aria-invalid, aria-describedby automáticos
  - NUEVO: forwardRef para mejor control

✅ Modal:
  - NUEVO: Focus trap (Tab navigation atrapado en modal)
  - NUEVO: Cierra con ESC
  - NUEVO: aria-modal, aria-label
  - MEJORADO: Semántica (usa <dialog>)

✅ Toast:
  - NUEVO: aria-live="polite" para anunciar a lectores
  - MEJORADO: Iconos con aria-hidden
  - MEJORADO: role="alert" para cada notificación

✅ Nuevos Archivos:
  - hooks/useDirtyState.js: Hook para detectar cambios
  - components/UnsavedChangesBar.jsx: Barra de cambios sin guardar

*/

// ===== MIGRATION GUIDE =====

/*
CAMBIOS REQUERIDOS EN COMPONENTES EXISTENTES:

1. Reemplazar containerClassName por className:
   ❌ <Input containerClassName="space-y-4" />
   ✅ <div className="space-y-4"><Input /></div>

2. Agregar aria-label a botones sin texto:
   ❌ <Button onClick={delete}>🗑️</Button>
   ✅ <Button ariaLabel="Eliminar" onClick={delete}>🗑️</Button>

3. Usar UnsavedChangesBar en formularios:
   ✅ <UnsavedChangesBar isDirty={isDirty} onSave={save} onDiscard={discard} />

4. Validación visual con Input:
   ✅ <Input error={error} errorMessage={errorMsg} />

5. Select ahora se valida igual que Input:
   ✅ <Select error={error} errorMessage={errorMsg} />

*/

export default function GuideUXDX() {
  return <div className="p-4 text-gray-600">Ver comentarios en el código para ejemplos</div>
}
