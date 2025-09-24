
class Output {
    head = '';
    body = '';
    #parent = null;

    constructor(parent) {
        this.#parent = parent;
    }

    push(str) {
        this.body += str;
    }
}

export async function renderToString(component) {
    const output = new Output(null);

    if (component.async) {
        await component(output, {});
    } else {
        component(output, {});
    }

    const { head, body } = output;

    return { head, body };
}

export function push_component() {
    debugger;
}

export function pop_component() {
    debugger;
}

export async function async(fn) {
    // TODO
}