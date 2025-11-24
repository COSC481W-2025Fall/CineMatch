//src/tests/App.testjsx
/**
 * Testing for basic app behaviors
 * Global tests about fetching and search functionality on search page
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'     // utilities to render react components
import App from '../App'        
import { BrowserRouter } from "react-router-dom"    // wrap App to use React router for navigation


// Mock global fetch before each test
beforeEach(() => {
  global.fetch = vi.fn(() =>    // mock successful api call
    Promise.resolve({
      ok: true,
      json: () =>               // json returned contents for "Inception"
        Promise.resolve([   
          {
            title: 'Inception',
            year: 2010,
            genre: ['Action', 'Sci-Fi'],
            rating: 8.8,
            posterUrl: 'https://test.poster/inception.jpg',
          },
        ]),
    })
  )
})

// Restore mock after each test to prevent tests from affecting eachother
afterEach(() => {
  vi.restoreAllMocks()
})
// Test suite
describe('CineMatch App', () => {   
  // test 1 - initial loading state, render app in fake router and verify app shows loading indicator
  it('renders initial loading state', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )
    expect(screen.getByText(/Loading/i)).toBeInTheDocument()
  })
  // test 2 - fetch and display movies, confirm data loading and rendering from mock api
  it('fetches and displays movies from API', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })

    expect(screen.getByText('2010 • Action, Sci-Fi')).toBeInTheDocument()
    expect(screen.getByText('⭐ 8.8')).toBeInTheDocument()
  })
  // test 3 - no results found, verify app handles empty json properly
  it('shows "No results found." if API returns empty list', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      })
    )

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/No results found/i)).toBeInTheDocument()
    })
  })
  // test 4 - api error handling, if fetch fails page should load "error loading results"
  it('handles fetch error gracefully', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Error loading results/i)).toBeInTheDocument()
    })
  })
// test 5 - Search interaction, find input by placeholder, "TITLE", simulate typing "Matrix", simulate clicking "SEARCH" button
  it('updates search params and triggers new search', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )

    const titleInput = screen.getByPlaceholderText(/TITLE.../i)
    fireEvent.change(titleInput, { target: { value: 'Matrix' } })
    fireEvent.click(screen.getAllByText(/SEARCH/i)[0])

    expect(global.fetch).toHaveBeenCalled()     // verify fetch called
    expect(titleInput.value).toBe('Matrix')     // verify input changed to "Matrix"
  })
  // test 6 - simulate clicking movie to open modal and confirm modal shows movie info
    it('opens MovieDetails modal when a movie is clicked', async () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      )
  
      // wait for movie card
      await waitFor(() => screen.getByText('Inception'))
  
      const movieCard = screen.getByText('Inception').closest('article')
      fireEvent.click(movieCard)
  
      // movieDetails content should appear
      await waitFor(() => screen.getByText('Inception'))
      expect(screen.getByText('2010 • Action, Sci-Fi')).toBeInTheDocument()
      expect(screen.getByText('⭐ 8.8')).toBeInTheDocument()
    })
})
