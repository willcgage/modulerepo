"use client";

import { deleteModule } from "./actions";

/** Delete a module — behind a confirm, since it permanently removes the module
 * and its schematic and can't be undone. */
export function DeleteModuleButton({
  moduleId,
  moduleName,
}: {
  moduleId: number;
  moduleName: string;
}) {
  return (
    <form
      action={deleteModule.bind(null, moduleId)}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete “${moduleName}”?\n\nThis permanently removes the module and its schematic (track, industries, everything). This can’t be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="text-xs font-medium text-red-600 hover:underline"
      >
        Delete module
      </button>
    </form>
  );
}
