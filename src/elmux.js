import React from 'react'
import Kefir from 'kefir';

export const CommandContext = React.createContext();


export const withStore = Component => {
    return <CommandContext.Consumer>
        {store => <Component store={store} />}
    </CommandContext.Consumer>;
}

/**
 * Creates a new global command handler that performs actions and schedules state changes
 * @param {React.Component} component React component that will store the state
 * @param {Function} update update function that will perform the actions
 * @param {Object} initialState initial global state
 * @returns {Object} created command handler (to be stored in the components state member)
 */
export function createCommandHandler(component, update, initialState = {}) {
    let emitter;
    const commandStream = Kefir.stream(e => { emitter = e; });

    const handler = {
        ...initialState,
        send: cmd => emitter.emit({ store: component, cmd }),
        update: (updater, subCmd, subObj) => Object.assign(subObj, updater(subObj, subCmd))
    };

    commandStream.onValue(e => {
        const { store, cmd } = e;
        const newModel = update(store.state, cmd);
        if (newModel && newModel !== {}) {
            store.setState(newModel);
        }
    });

    component.emitter = emitter;

    return handler;
}

